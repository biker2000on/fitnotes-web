package models

import "encoding/json"

// An omitted timestamp from an older client preserves recorded timing. An
// explicit null from a current client clears it, including offline undo/bulk
// completion where the intermediate unchecked state was never synced.
func (log *TrainingLog) UnmarshalJSON(data []byte) error {
	type wireLog TrainingLog
	var value wireLog
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	*log = TrainingLog(value)
	_, log.CompletedAtProvided = fields["completed_at"]
	return nil
}
