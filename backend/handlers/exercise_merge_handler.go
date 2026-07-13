package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"backend/db"
	"backend/middleware"

	"github.com/google/uuid"
)

type exerciseMergeRequest struct {
	SourceID uuid.UUID `json:"source_id"`
	TargetID uuid.UUID `json:"target_id"`
}

// MergeExercisesHandler moves every reference from a duplicate exercise to a
// canonical exercise and then soft-deletes the duplicate. The duplicate's
// name and aliases are retained as searchable aliases on the canonical row.
func MergeExercisesHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req exerciseMergeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SourceID == uuid.Nil || req.TargetID == uuid.Nil || req.SourceID == req.TargetID {
		http.Error(w, `{"error":"source_id and a different target_id are required"}`, http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := db.GetDB().Begin(ctx)
	if err != nil {
		http.Error(w, `{"error":"failed to begin merge"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var sourceName string
	var sourceAliases *string
	if err := tx.QueryRow(ctx, `SELECT name, aliases FROM exercises WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE FOR UPDATE`, req.SourceID, userID).Scan(&sourceName, &sourceAliases); err != nil {
		http.Error(w, `{"error":"source exercise not found"}`, http.StatusNotFound)
		return
	}
	var targetName string
	if err := tx.QueryRow(ctx, `SELECT name FROM exercises WHERE id = $1 AND user_id = $2 AND is_deleted = FALSE FOR UPDATE`, req.TargetID, userID).Scan(&targetName); err != nil {
		http.Error(w, `{"error":"target exercise not found"}`, http.StatusNotFound)
		return
	}

	aliases := sourceName
	if sourceAliases != nil && strings.TrimSpace(*sourceAliases) != "" {
		aliases += ", " + strings.TrimSpace(*sourceAliases)
	}
	if _, err := tx.Exec(ctx, `
		UPDATE exercises SET aliases = concat_ws(', ', NULLIF(aliases, ''), $1), last_modified = CURRENT_TIMESTAMP
		WHERE id = $2 AND user_id = $3`, aliases, req.TargetID, userID); err != nil {
		http.Error(w, `{"error":"failed to preserve aliases"}`, http.StatusInternalServerError)
		return
	}

	// Tables with direct exercise references. Ownership predicates make the
	// operation safe even if malformed cross-user IDs are submitted.
	updates := []struct {
		table      string
		userScoped bool
	}{
		{"training_logs", true}, {"workout_group_exercises", true}, {"goals", true},
		{"barbells", true}, {"graph_favourites", true},
	}
	counts := map[string]int64{}
	for _, u := range updates {
		query := `UPDATE ` + u.table + ` SET exercise_id = $1, last_modified = CURRENT_TIMESTAMP WHERE exercise_id = $2`
		args := []any{req.TargetID, req.SourceID}
		if u.userScoped {
			query += ` AND user_id = $3`
			args = append(args, userID)
		}
		result, err := tx.Exec(ctx, query, args...)
		if err != nil {
			http.Error(w, `{"error":"failed to move exercise references"}`, http.StatusInternalServerError)
			return
		}
		counts[u.table] = result.RowsAffected()
	}

	result, err := tx.Exec(ctx, `
		UPDATE routine_section_exercises rse
		SET exercise_id = $1, last_modified = CURRENT_TIMESTAMP
		FROM routine_sections rs JOIN routines r ON r.id = rs.routine_id
		WHERE rse.routine_section_id = rs.id AND rse.exercise_id = $2 AND r.user_id = $3`, req.TargetID, req.SourceID, userID)
	if err != nil {
		http.Error(w, `{"error":"failed to move routine references"}`, http.StatusInternalServerError)
		return
	}
	counts["routine_section_exercises"] = result.RowsAffected()

	// Consolidate same-day comments without violating the unique constraint.
	if _, err := tx.Exec(ctx, `
		INSERT INTO exercise_comments (id, user_id, exercise_id, date, comment, last_modified, is_deleted)
		SELECT gen_random_uuid(), user_id, $1, date, comment, CURRENT_TIMESTAMP, FALSE
		FROM exercise_comments WHERE user_id = $2 AND exercise_id = $3 AND is_deleted = FALSE
		ON CONFLICT (user_id, exercise_id, date) DO UPDATE SET
			comment = concat_ws(E'\n', NULLIF(exercise_comments.comment, ''), NULLIF(EXCLUDED.comment, '')),
			last_modified = CURRENT_TIMESTAMP, is_deleted = FALSE`, req.TargetID, userID, req.SourceID); err != nil {
		http.Error(w, `{"error":"failed to merge exercise comments"}`, http.StatusInternalServerError)
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE exercise_comments SET is_deleted = TRUE, last_modified = CURRENT_TIMESTAMP WHERE user_id = $1 AND exercise_id = $2`, userID, req.SourceID); err != nil {
		http.Error(w, `{"error":"failed to retire duplicate comments"}`, http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec(ctx, `UPDATE exercises SET is_deleted = TRUE, last_modified = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`, req.SourceID, userID); err != nil {
		http.Error(w, `{"error":"failed to retire duplicate exercise"}`, http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		http.Error(w, `{"error":"failed to commit merge"}`, http.StatusInternalServerError)
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"source_id": req.SourceID, "target_id": req.TargetID,
		"source_name": sourceName, "target_name": targetName, "moved": counts,
	})
}
