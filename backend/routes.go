
package main

import (
	"fmt"
	"net/http"
)

// Function to set up routes
func setupRoutes() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Hello, World!")
	})

	// Add more routes as needed
}

func main() {
	// Set up routes
	setupRoutes()

	// Start the server
	fmt.Println("Server started at :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		fmt.Println("Error starting the server:", err)
	}
}
