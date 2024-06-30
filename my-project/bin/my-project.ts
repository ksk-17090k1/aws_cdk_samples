#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MyLambdaStack } from "../lib/my-lambda-stack";

const app = new cdk.App();
new MyLambdaStack(app, "MyLambdaStack", {});
