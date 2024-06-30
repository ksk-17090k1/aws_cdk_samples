import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_lambda from "aws-cdk-lib/aws-lambda";
import { aws_apigateway } from "aws-cdk-lib";
import { aws_lambda_nodejs } from "aws-cdk-lib";

export class MyLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // NOTE: JavaScriptの場合、拡張子をmjsにしないと動かない
    const jsHandler = new aws_lambda.Function(this, "MyHandler", {
      functionName: "myHandler",
      handler: "handler.handler",
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      code: new aws_lambda.AssetCode(`./src/lambda`),
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
    });

    // TypeScriptでLambdaを作成する場合
    const TsHandler = new aws_lambda_nodejs.NodejsFunction(
      this,
      "TypeScriptHandler",
      {
        functionName: "TypeScriptHandler",
        entry: "./src/lambda/ts-hello.ts",
        handler: "handler",
        runtime: aws_lambda.Runtime.NODEJS_20_X,
      }
    );

    // NOTE: Lambdaと統合前提ならLambdaRestApiの方がコード量減っていいかも
    const restApi = new aws_apigateway.RestApi(this, "MyRestApi", {
      deployOptions: {
        stageName: "v1",
      },
      restApiName: `myRestApi`,
    });

    const integration = new aws_apigateway.LambdaIntegration(TsHandler, {
      // Lambda proxy integration (default is true)
      // ref: https://qiita.com/_mogaming/items/2bd83204e212e35b2c6c
      proxy: true,
    });

    const restApiHelloWorld = restApi.root.addResource("hello");
    restApiHelloWorld.addMethod("GET", integration);
    restApiHelloWorld.addMethod("POST", integration);
  }
}
