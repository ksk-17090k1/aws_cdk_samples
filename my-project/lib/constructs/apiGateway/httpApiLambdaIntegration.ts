import { Construct } from "constructs";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
  HttpStage,
} from "aws-cdk-lib/aws-apigatewayv2";
import * as cdk from "aws-cdk-lib";
import { IFunction } from "aws-cdk-lib/aws-lambda";

type Props = {
  handler: IFunction;
};

export class MyHttpApiLambdaIntegration extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // 本当はちゃんと設定したほうがいい
    const allowOrigins = ["*"];

    const api = new HttpApi(this, "MyHttpApi", {
      // 下でStageオブジェクトを作成する場合はここをfalseにする！
      createDefaultStage: false,
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.HEAD,
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
        ],
        allowOrigins: allowOrigins,
        maxAge: cdk.Duration.days(10),
      },
    });

    // --- Integrationオブジェクト、Authorizerオブジェクトの作成 ---
    // IntegrationオブジェクトがLambda関数を保持する。
    const integration = new HttpLambdaIntegration("Integration", props.handler);
    // const authorizer = new HttpUserPoolAuthorizer(
    //   "Authorizer",
    //   props.auth.userPool,
    //   {
    //     userPoolClients: [props.auth.client],
    //   }
    // );

    // HttpRouteオブジェクトの作成
    // おそらく内部ではルートパスのResourceオブジェクトがMethodオブジェクトを保持し、
    // MethodオブジェクトがIntegrationオブジェクト, Authorizerオブジェクトを保持している
    const root = api.addRoutes({
      path: "/{proxy+}",
      integration,
      methods: [
        HttpMethod.GET,
        HttpMethod.POST,
        HttpMethod.PUT,
        HttpMethod.PATCH,
        HttpMethod.DELETE,
      ],
      //   authorizer,
    });

    // StageオブジェクトはHttpApiオブジェクトを保持する
    // スロットリングを設定するにはStageオブジェクトを作成する必要がある
    new HttpStage(this, "MyStage", {
      httpApi: api,
      // stageは指定しないと$defaultを使う
      //   stageName: "beta",
      //   description: "My Stage",
      throttle: {
        rateLimit: 20,
        burstLimit: 200,
      },
      // これはデフォルトでfalseなのでtrueにしておいた方がよさそう。
      autoDeploy: true,
    });
  }
}
