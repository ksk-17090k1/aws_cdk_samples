#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MyLambdaStack } from "../lib/my-lambda-stack";
import { MyVpcStack } from "../lib/my-vpc-stack";

const app = new cdk.App();
// new MyLambdaStack(app, "MyLambdaStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: "ap-northeast-1",
//   },
// });
new MyVpcStack(app, "MyVpcStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
});
