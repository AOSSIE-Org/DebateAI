package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"regexp"

	"log"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider/types"
)
var(
	
)
func SignUpRouteHandler(ctx *gin.Context){
	fmt.Println("signing up");
	
	password := "abc123!"
	email := "keshavnischal@gmail.com";

	signUpWithCognito(email, password);
	ctx.JSON(200, "signing up");
}
func signUpWithCognito(email string, password string) {
	ctx := context.Background()
	config, err := config.LoadDefaultConfig(ctx, config.WithRegion("ap-south-1"))
	
	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Successfully Loaded the cognito config for signUp")
	}
	
	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	
	secretHash := generateSecretHash(email, appClientId, appClientSecret)
	
	signupInput := cognitoidentityprovider.SignUpInput{
		ClientId:   aws.String(appClientId),
		Password:   aws.String(password),
		SecretHash: aws.String(secretHash),
		Username: aws.String(email),
		UserAttributes: []types.AttributeType{
			{
				Name:  aws.String("email"),
				Value: aws.String(email),
			},
			{
				//todo: email and other fields should have some validation
				Name:  aws.String("nickname"),
				Value: aws.String(extractNameFromEmail(email)),
			},
		},
	}
	signupStatus, err := cognitoClient.SignUp(ctx, &signupInput)
	
	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Sign-up successful:", signupStatus)
	}
}
func VerifyEmailRouteHandler(ctx *gin.Context){
	email := "keshavnischal@gmail.com"
	confirmationCode := "985588";
	
	verifyEmailWithCognito(email, confirmationCode)
}
func verifyEmailWithCognito(email string, confirmationCode string){
	ctx := context.Background()
	config, _ := config.LoadDefaultConfig(ctx, config.WithRegion("ap-south-1"))
	
	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	
	

	secretHash := generateSecretHash(email, appClientId, appClientSecret)
	confirmSignUpInput := cognitoidentityprovider.ConfirmSignUpInput{
		ClientId: aws.String(appClientId), 
		ConfirmationCode: aws.String(confirmationCode),
		Username: aws.String(email), 
		SecretHash: aws.String(secretHash),
	}
	confirmationStatus, err := cognitoClient.ConfirmSignUp(ctx, &confirmSignUpInput);

	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Sign-up successful:", confirmationStatus)
	}
}
func generateSecretHash(username, clientId, clientSecret string) string {
	hmacInstance := hmac.New(sha256.New, []byte(clientSecret));
	hmacInstance.Write([]byte(username+clientId));
	secretHashByte := hmacInstance.Sum(nil);
	
	secretHashString := base64.StdEncoding.EncodeToString(secretHashByte);
	return secretHashString;
}
func extractNameFromEmail(email string) string{
	re := regexp.MustCompile(`^([^@]+)`)
    
    match := re.FindStringSubmatch(email)

	return match[1];
}
func SignInRouteHandler(ctx *gin.Context){
	email := "keshavnischal@gmail.com"
	password := "abc123!"
	signInWithCognito(email, password)
}
func signInWithCognito(email string, password string){
	ctx := context.Background()
	config, _ := config.LoadDefaultConfig(ctx, config.WithRegion("ap-south-1"))
	
	cognitoClient := cognitoidentityprovider.NewFromConfig(config)
	
	secretHash := generateSecretHash(email, appClientId, appClientSecret)
	authInput := cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: types.AuthFlowTypeUserPasswordAuth,
		ClientId: aws.String(appClientId),
		AuthParameters: map[string]string{
			"USERNAME":email,
			"PASSWORD":password,
			"SECRET_HASH": secretHash,
		},
	}
	authOutput,err := cognitoClient.InitiateAuth(ctx, &authInput)

	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Sign-in successful:", authOutput.AuthenticationResult)
	}
}






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
	router.GET("/signup", SignUpRouteHandler)
	router.GET("/verifyEmail", VerifyEmailRouteHandler)

	router.GET("/signin", SignInRouteHandler)


	//web rtc
	router.GET("/initiateCall", InitiateCallHandler)


	router.Run()
}

func main(){
	// Initialize the WebSocket hub
	hub := NewChatHub()
	go hub.Start()

	// WebSocket route for handling connections
	router.GET("/ws", WebSocketHandler(hub))
}

func helloWorld(ctx *gin.Context){
	fmt.Println("Keshav");
	ctx.JSON(200, "keshav")
}
