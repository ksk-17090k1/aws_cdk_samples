import { Construct } from "constructs";
import { aws_apigateway, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";

type Props = {};

export class MyTsHandler extends Construct {
  readonly tsHandler: aws_lambda_nodejs.NodejsFunction;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const tsHandler = new aws_lambda_nodejs.NodejsFunction(
      this,
      "MyTsHandlerFunc",
      {
        functionName: "myTsHandler",
        entry: "./src/lambda/ts-hello.ts",
        handler: "handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        runtime: aws_lambda.Runtime.NODEJS_20_X,
      }
    );
    this.tsHandler = tsHandler;
  }
}
