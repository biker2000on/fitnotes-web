package handlers

import (
	"net/http"
	"strings"
	"time"

	"backend/db"
	"backend/middleware"

	"github.com/google/uuid"
)

type apiWorkoutTime struct {
	ID              uuid.UUID  `json:"id"`
	Date            string     `json:"date"`
	StartTime       *time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	DurationSeconds *int       `json:"duration_seconds"`
	LastModified    time.Time  `json:"last_modified"`
	IsDeleted       bool       `json:"is_deleted"`
}

// Include tombstones so consumers can invalidate removed timers.
func APIWorkoutTimesHandler(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserID(r.Context())
	if err != nil {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	from, to := strings.TrimSpace(r.URL.Query().Get("from")), strings.TrimSpace(r.URL.Query().Get("to"))
	if !validDateFilter(from) || !validDateFilter(to) {
		http.Error(w, `{"error":"from and to must use YYYY-MM-DD"}`, http.StatusBadRequest)
		return
	}
	limit, offset := apiPagination(r)
	rows, err := db.GetDB().Query(r.Context(), `SELECT id, to_char(date,'YYYY-MM-DD'),start_time,end_time,duration_seconds,last_modified,is_deleted
 FROM workout_times WHERE user_id=$1 AND ($2::date IS NULL OR date >= $2::date) AND ($3::date IS NULL OR date <= $3::date)
 ORDER BY date DESC,id LIMIT $4 OFFSET $5`, userID, nilIfEmpty(from), nilIfEmpty(to), limit, offset)
	if err != nil {
		http.Error(w, `{"error":"failed to query workout times"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	items := make([]apiWorkoutTime, 0)
	for rows.Next() {
		var item apiWorkoutTime
		if err := rows.Scan(&item.ID, &item.Date, &item.StartTime, &item.EndTime, &item.DurationSeconds, &item.LastModified, &item.IsDeleted); err != nil {
			http.Error(w, `{"error":"failed to read workout times"}`, http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		http.Error(w, `{"error":"failed to read workout times"}`, http.StatusInternalServerError)
		return
	}
	writeAPIData(w, items, limit, offset, len(items))
}
