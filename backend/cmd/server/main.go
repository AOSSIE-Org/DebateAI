package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)
var(
	appClientId = "your-app-client-id" // Cognito App Client ID
    appClientSecret = "your-app-client-secret" // Cognito App Client Secret
)







func InitiateCallHandler(ctx *gin.Context){
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	conn, _ := upgrader.Upgrade(ctx.Writer, ctx.Request, nil);
	defer conn.Close();

	for {
		_, p, _:= conn.ReadMessage()
		
	}
}

func AnswerCallHandler(ctx *gin.Context){
	// sdpOffer := "v=0\r\no=- 3606227667976518322 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=extmap-allow-mixed\r\na=msid-semantic: WMS\r\n";

}


func server() {
	router := gin.Default();	
	
	router.GET("/", helloWorld)
	
	//authentication
	authGroup := router.Group("/auth")
	{
		authGroup.GET("/signup", SignUpRouteHandler)
		authGroup.GET("/confirmSignUp", ConfirmSignUpRouteHandler)
		authGroup.POST("/signin", SignInRouteHandler)
		authGroup.POST("/signout", SignOutRouteHandler)
		authGroup.POST("/refresh", RefreshTokenRouteHandler)
		authGroup.POST("/forgotPassword", ForgotPasswordRouteHandler)
		authGroup.POST("/resetPassword", ResetPasswordRouteHandler)
		authGroup.GET("/verifyEmail", VerifyEmailRouteHandler)
		authGroup.GET("/profile", ProfileRouteHandler)
		authGroup.PUT("/profile", UpdateProfileRouteHandler)
		authGroup.DELETE("/account", DeleteAccountRouteHandler)
	}


	//web rtc
	router.GET("/initiateCall", InitiateCallHandler)


	router.Run()
}

func main(){
	// server();
	StartWebSocketServer();
}

func helloWorld(ctx *gin.Context){
	fmt.Println("Keshav");
	ctx.JSON(200, "keshav")
}
