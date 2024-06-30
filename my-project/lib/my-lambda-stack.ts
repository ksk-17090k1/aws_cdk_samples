import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_apigateway, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";

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
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        runtime: aws_lambda.Runtime.NODEJS_20_X,
      }
    );

    // NOTE: Lambdaと統合前提ならLambdaRestApiの方がコード量減っていいかも
    const restApi = new aws_apigateway.RestApi(this, "MyRestApi", {
      deployOptions: {
        stageName: "v2",
      },
      restApiName: `myRestApi`,
    });

    const integration = new aws_apigateway.LambdaIntegration(TsHandler, {
      // Lambda proxy integration (default is true)
      // ref: https://qiita.com/_mogaming/items/2bd83204e212e35b2c6c
      proxy: true,
    });

    const books = restApi.root.addResource("books");
    const getMethod = books.addMethod("GET", integration);
    const postMethod = books.addMethod("POST", integration, {
      apiKeyRequired: true,
    });

    const book = books.addResource("{id}");
    book.addMethod("GET", integration);

    // 使用料プランを作って、API keyとstageに紐づける
    const plan = restApi.addUsagePlan("UsagePlan", {
      name: "Normal",
      throttle: {
        rateLimit: 20,
        burstLimit: 200,
      },
    });
    plan.addApiKey(restApi.addApiKey("apiKey"));
    plan.addApiStage({
      stage: restApi.deploymentStage,
      // メソッドレベルでのスロットリング (optional)
      throttle: [
        {
          method: postMethod,
          throttle: {
            rateLimit: 10,
            burstLimit: 20,
          },
        },
      ],
    });
  }
}
