#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MyLambdaStack } from "../lib/my-lambda-stack";
import { MyVpcStack } from "../lib/my-vpc-stack";
import { MyEc2Stack } from "../lib/my-ec2-stack";
import { MySbcntrStack } from "../lib/my-sbcntr-stack";
import { ScopedAws } from "aws-cdk-lib";
import { MyEcsStack } from "../lib/my-ecs-stack";

const app = new cdk.App();

// Set Resource Name
const resourceName = "myapp";

// new MyLambdaStack(app, "MyLambdaStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: "ap-northeast-1",
//   },
// });
// new MyVpcStack(app, "MyVpcStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: "ap-northeast-1",
//   },
// });

// new MyEc2Stack(app, "MyEc2Stack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: "ap-northeast-1",
//   },
// });

// new MySbcntrStack(app, `MySbcntrStack${resourceName}`, {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: "ap-northeast-1",
//   },
// });

new MyEcsStack(app, "MyEcsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  accountId: process.env.CDK_DEFAULT_ACCOUNT,
  region: "ap-northeast-1",
  resourceName,
});
