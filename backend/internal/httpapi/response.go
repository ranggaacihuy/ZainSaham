package httpapi

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func respond(c *gin.Context, status int, message string, data any) {
	body := gin.H{"success": true}
	if message != "" {
		body["message"] = message
	}
	if data != nil {
		body["data"] = data
	}

	c.JSON(status, body)
}

func ok(c *gin.Context, data any) {
	respond(c, http.StatusOK, "", data)
}

func fail(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, gin.H{"success": false, "message": message})
}

func failWithData(c *gin.Context, status int, message string, data any) {
	c.AbortWithStatusJSON(status, gin.H{"success": false, "message": message, "data": data})
}

func serverError(c *gin.Context, err error) {
	log.Printf("%s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	fail(c, http.StatusInternalServerError, "Terjadi kesalahan pada server.")
}

func idParam(c *gin.Context, name, notFoundMessage string) (uint, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || id == 0 {
		fail(c, http.StatusNotFound, notFoundMessage)
		return 0, false
	}

	return uint(id), true
}
