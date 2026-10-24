package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
)

var (
	validationOnce sync.Once
	fieldLabels    = map[string]string{
		"name":                  "Nama",
		"email":                 "Email",
		"password":              "Kata sandi",
		"password_confirmation": "Konfirmasi kata sandi",
		"current_password":      "Kata sandi saat ini",
		"range":                 "Rentang waktu",
		"user_id":               "Pengguna",
		"stock_id":              "Saham",
		"session_id":            "Sesi",
		"analysis_type":         "Jenis analisis",
		"message":               "Pesan",
	}
)

func registerValidation() {
	validationOnce.Do(func() {
		if engine, ok := binding.Validator.Engine().(*validator.Validate); ok {
			engine.RegisterTagNameFunc(func(field reflect.StructField) string {
				name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
				if name == "-" {
					return ""
				}

				return name
			})
		}
	})
}

func bind(c *gin.Context, target any) bool {
	err := json.NewDecoder(c.Request.Body).Decode(target)
	if errors.Is(err, io.EOF) {
		err = nil
	}

	if err == nil {
		trimStrings(target)
		err = binding.Validator.ValidateStruct(target)
	}

	if err == nil {
		return true
	}

	errs := map[string][]string{}

	var validationErrs validator.ValidationErrors
	var typeErr *json.UnmarshalTypeError

	switch {
	case errors.As(err, &validationErrs):
		for _, fieldErr := range validationErrs {
			key, message := validationMessage(fieldErr)
			errs[key] = append(errs[key], message)
		}
	case errors.As(err, &typeErr) && typeErr.Field != "":
		errs[typeErr.Field] = []string{label(typeErr.Field) + " tidak valid."}
	}

	c.AbortWithStatusJSON(http.StatusUnprocessableEntity, gin.H{
		"success": false,
		"message": "Data yang dikirim tidak valid.",
		"errors":  errs,
	})

	return false
}

func trimStrings(target any) {
	value := reflect.ValueOf(target).Elem()
	kind := value.Type()

	for i := range value.NumField() {
		field := value.Field(i)
		name, _, _ := strings.Cut(kind.Field(i).Tag.Get("json"), ",")

		if field.Kind() == reflect.String && field.CanSet() && !strings.Contains(name, "password") {
			field.SetString(strings.TrimSpace(field.String()))
		}
	}
}

func validationError(c *gin.Context, field, message string) {
	c.AbortWithStatusJSON(http.StatusUnprocessableEntity, gin.H{
		"success": false,
		"message": "Data yang dikirim tidak valid.",
		"errors":  map[string][]string{field: {message}},
	})
}

func validationMessage(fieldErr validator.FieldError) (string, string) {
	field := fieldErr.Field()
	name := label(field)

	if field == "password_confirmation" {
		if fieldErr.Tag() == "eqfield" {
			return "password", "Konfirmasi kata sandi tidak cocok."
		}

		return "password", "Konfirmasi kata sandi wajib diisi."
	}

	switch fieldErr.Tag() {
	case "required":
		return field, name + " wajib diisi."
	case "email":
		return field, "Format email tidak valid."
	case "min":
		return field, fmt.Sprintf("%s minimal %s karakter.", name, fieldErr.Param())
	case "max":
		return field, fmt.Sprintf("%s maksimal %s karakter.", name, fieldErr.Param())
	default:
		return field, name + " tidak valid."
	}
}

func label(field string) string {
	if name, ok := fieldLabels[field]; ok {
		return name
	}

	return field
}
