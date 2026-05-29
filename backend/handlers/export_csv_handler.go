package handlers

import (
	"encoding/csv"
	"net/http"
	"strconv"

	"backend/db"
	"backend/middleware"
)

// ExportCSVHandler streams the user's workout data as a CSV spreadsheet,
// matching the FitNotes "Spreadsheet Export" column format.
func ExportCSVHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	pool := db.GetDB()
	ctx := r.Context()

	rows, err := pool.Query(ctx, `
		SELECT tl.date::text, e.name, COALESCE(c.name, ''),
		       COALESCE(tl.metric_weight, 0), COALESCE(tl.reps, 0),
		       COALESCE(tl.distance, 0), COALESCE(tl.duration_seconds, 0),
		       COALESCE(tl.comment, '')
		FROM training_logs tl
		JOIN exercises e ON tl.exercise_id = e.id
		LEFT JOIN categories c ON e.category_id = c.id
		WHERE tl.user_id = $1 AND tl.is_deleted = FALSE
		ORDER BY tl.date, e.name`,
		userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"error":"failed to query workout data"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="FitNotes_Export.csv"`)
	cw := csv.NewWriter(w)
	defer cw.Flush()

	_ = cw.Write([]string{"Date", "Exercise", "Category", "Weight", "Reps", "Distance", "Time", "Comment"})

	for rows.Next() {
		var date, name, cat, comment string
		var weight, distance float64
		var reps, duration int
		if err := rows.Scan(&date, &name, &cat, &weight, &reps, &distance, &duration, &comment); err != nil {
			return
		}
		hh := duration / 3600
		mm := (duration % 3600) / 60
		ss := duration % 60
		timeStr := ""
		if duration > 0 {
			timeStr = strconv.Itoa(hh) + ":" + pad(mm) + ":" + pad(ss)
		}
		_ = cw.Write([]string{
			date, name, cat,
			strconv.FormatFloat(weight, 'f', -1, 64),
			strconv.Itoa(reps),
			strconv.FormatFloat(distance, 'f', -1, 64),
			timeStr, comment,
		})
	}
}

func pad(n int) string {
	if n < 10 {
		return "0" + strconv.Itoa(n)
	}
	return strconv.Itoa(n)
}
