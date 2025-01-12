#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MyDomainStack } from "../lib/my-domain-stack";
import { MyLambdaStack } from "../lib/my-lambda-stack";

const app = new cdk.App();

// Set Resource Name
const resourceName = "myapp";

// const publicDomain = new MyDomainStack(app, "MyDomainStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     // region: "'us-east-1'",
//     region: "ap-northeast-1",
//   },
//   // クロスリージョンでリソースを渡したい場合は以下を指定
//   // NOTE: 渡す先のスタックにも同じように指定する必要あり。
//   crossRegionReferences: true,
// });

new MyLambdaStack(app, "MyLambdaStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
});

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

// new MyEcsStack(app, "MyEcsStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     region: "ap-northeast-1",
//   },
//   accountId: process.env.CDK_DEFAULT_ACCOUNT,
//   region: "ap-northeast-1",
//   resourceName,
// });

// new MyWafStack(app, "MyWafStack", {
//   env: {
//     account: process.env.CDK_DEFAULT_ACCOUNT,
//     // region: "ap-northeast-1",
//     // cloud front のWAFは us-east-1 でしか使えない
//     region: "us-east-1",
//   },
// });
