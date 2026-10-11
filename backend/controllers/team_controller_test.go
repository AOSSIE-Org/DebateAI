package controllers

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestBuildJoinTeamFilter(t *testing.T) {
	teamID := primitive.NewObjectID()
	userID := primitive.NewObjectID()

	filter := buildJoinTeamFilter(teamID, userID)

	// Verify team ID match
	if filter["_id"] != teamID {
		t.Errorf("expected filter _id to be %v, got %v", teamID, filter["_id"])
	}

	// Verify user is not already in members
	userNeFilter, ok := filter["members.userId"].(bson.M)
	if !ok || userNeFilter["$ne"] != userID {
		t.Errorf("expected filter members.userId to be $ne: %v, got %v", userID, filter["members.userId"])
	}

	// Verify $expr atomic capacity check
	expr, ok := filter["$expr"].(bson.M)
	if !ok {
		t.Fatalf("expected filter to contain $expr operator")
	}

	ltCond, ok := expr["$lt"].(bson.A)
	if !ok || len(ltCond) != 2 {
		t.Fatalf("expected $lt operator with 2 operands in $expr")
	}

	sizeExpr, ok := ltCond[0].(bson.M)
	if !ok || sizeExpr["$size"] != "$members" {
		t.Errorf("expected first operand to be $size: $members, got %v", ltCond[0])
	}

	condExpr, ok := ltCond[1].(bson.M)
	if !ok || condExpr["$cond"] == nil {
		t.Errorf("expected second operand to be $cond for maxSize fallback, got %v", ltCond[1])
	}
}
