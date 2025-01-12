import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_apigateway, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import { MyJsHandler } from "./constructs/lambda/js-handler";
import { MyTsHandler } from "./constructs/lambda/ts-handler";
import { MyRestApiLambdaIntegration } from "./constructs/apiGateway/restApiLambdaIntegration";
import { MyDockerImageHandler } from "./constructs/lambda/docker-image-handler";
import { MyHttpApiLambdaIntegration } from "./constructs/apiGateway/httpApiLambdaIntegration";

type Props = cdk.StackProps & {};

export class MyLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    // JavaScript
    new MyJsHandler(this, "MyJsHandler", {});
    // TypeScript
    new MyTsHandler(this, "MyTsHandler", {});

    // Docker Image Function
    const dockerHandler = new MyDockerImageHandler(
      this,
      "MyDockerImageHandler",
      {}
    );

    // API Gateway Lambda Integration (REST API)
    new MyRestApiLambdaIntegration(this, "MyRestApiLambdaIntegration", {
      handler: dockerHandler.handler,
    });

    // API Gateway Lambda Integration (HTTP API)
    new MyHttpApiLambdaIntegration(this, "MyHttpApiLambdaIntegration", {
      handler: dockerHandler.handler,
    });
  }
}
