import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_lambda from "aws-cdk-lib/aws-lambda";

export class MyLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // NOTE: cdk deployの前にnpm run buildしてください
    //       もしくは、TypeScript使う前提ならaws_lambda_nodejs使ってもいいかも

    new aws_lambda.Function(this, "HelloWorld", {
      functionName: "HelloWorld",
      handler: "handler.handler",
      runtime: aws_lambda.Runtime.NODEJS_LATEST,
      code: new aws_lambda.AssetCode(`./src/helloWorld`),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
    });
  }
}
