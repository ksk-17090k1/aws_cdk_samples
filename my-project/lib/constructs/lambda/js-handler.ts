import { Construct } from "constructs";
import { aws_apigateway, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";

type Props = {};

export class MyJsHandler extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // NOTE: JavaScriptの場合、拡張子をmjsにしないと動かない
    const jsHandler = new aws_lambda.Function(this, "MyJsHandlerFunc", {
      functionName: "myJsHandler",
      handler: "handler.handler",
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      code: new aws_lambda.AssetCode(`./src/lambda`),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
    });
  }
}
