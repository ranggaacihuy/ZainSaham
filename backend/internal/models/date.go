package models

import (
	"database/sql/driver"
	"fmt"
	"time"
)

const dateLayout = "2006-01-02"

type Date struct {
	time.Time
}

func NewDate(t time.Time) Date {
	year, month, day := t.Date()

	return Date{time.Date(year, month, day, 0, 0, 0, 0, time.UTC)}
}

func ParseDate(value string) (Date, error) {
	if len(value) > len(dateLayout) {
		value = value[:len(dateLayout)]
	}

	t, err := time.Parse(dateLayout, value)
	if err != nil {
		return Date{}, err
	}

	return Date{t}, nil
}

func (d Date) String() string {
	return d.Format(dateLayout)
}

func (Date) GormDataType() string {
	return "date"
}

func (d Date) Value() (driver.Value, error) {
	return d.String(), nil
}

func (d *Date) Scan(value any) error {
	switch v := value.(type) {
	case time.Time:
		*d = NewDate(v)
	case string:
		parsed, err := ParseDate(v)
		if err != nil {
			return err
		}
		*d = parsed
	case []byte:
		parsed, err := ParseDate(string(v))
		if err != nil {
			return err
		}
		*d = parsed
	case nil:
		*d = Date{}
	default:
		return fmt.Errorf("tipe tanggal tidak didukung: %T", value)
	}

	return nil
}

func (d Date) MarshalJSON() ([]byte, error) {
	if d.IsZero() {
		return []byte("null"), nil
	}

	return []byte(`"` + d.String() + `"`), nil
}
