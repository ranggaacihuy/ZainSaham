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
	"unicode"

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
	weakPasswordPatterns = []string{
		"123456",
		"12345678",
		"password",
		"qwerty",
		"admin123",
		"zainsaham",
		"letmein",
		"welcome",
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

			_ = engine.RegisterValidation("strong_password", func(fl validator.FieldLevel) bool {
				return validateStrongPassword(fl.Field().String()) == nil
			})
		}
	})
}

func validateStrongPassword(password string) error {
	runes := []rune(password)
	if len(runes) < 8 {
		return errors.New("Kata sandi minimal 8 karakter.")
	}
	if len(runes) > 72 {
		return errors.New("Kata sandi maksimal 72 karakter.")
	}

	var hasUpper, hasLower, hasDigit, hasSymbol bool
	repeatCount := 1

	for i, r := range runes {
		if unicode.IsSpace(r) {
			return errors.New("Kata sandi tidak boleh mengandung spasi.")
		}

		switch {
		case unicode.IsUpper(r):
			hasUpper = true
		case unicode.IsLower(r):
			hasLower = true
		case unicode.IsDigit(r):
			hasDigit = true
		case unicode.IsPunct(r) || unicode.IsSymbol(r):
			hasSymbol = true
		}

		if i > 0 && r == runes[i-1] {
			repeatCount++
			if repeatCount >= 4 {
				return errors.New("Kata sandi tidak boleh mengulang karakter yang sama 4 kali berturut-turut.")
			}
		} else {
			repeatCount = 1
		}
	}

	if !hasUpper || !hasLower || !hasDigit || !hasSymbol {
		return errors.New("Kata sandi harus mengandung huruf besar, huruf kecil, angka, dan simbol (contoh: R4ngga17!).")
	}

	lower := strings.ToLower(password)
	for _, weak := range weakPasswordPatterns {
		if strings.Contains(lower, weak) {
			return errors.New("Kata sandi terlalu umum dan mudah ditebak.")
		}
	}

	return nil
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
	case "strong_password":
		if val, ok := fieldErr.Value().(string); ok {
			if err := validateStrongPassword(val); err != nil {
				return field, err.Error()
			}
		}
		return field, "Kata sandi harus mengandung huruf besar, huruf kecil, angka, dan simbol (contoh: R4ngga17!)."
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