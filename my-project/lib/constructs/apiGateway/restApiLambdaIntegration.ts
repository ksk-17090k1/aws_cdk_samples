import { Construct } from "constructs";
import { aws_apigateway, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import { IFunction } from "aws-cdk-lib/aws-lambda";

type Props = {
  handler: IFunction;
};

export class MyRestApiLambdaIntegration extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    // NOTE: Lambdaと統合前提ならLambdaRestApiの方がコード量減っていいかも
    const restApi = new aws_apigateway.RestApi(this, "MyRestApi", {
      deployOptions: {
        stageName: "v2",
      },
      restApiName: `myRestApi`,
    });

    // IntegrationオブジェクトがLambda関数を保持する
    const integration = new aws_apigateway.LambdaIntegration(props.handler, {
      // Lambda proxy integration (default is true)
      // ref: https://qiita.com/_mogaming/items/2bd83204e212e35b2c6c
      proxy: true,
    });

    // --- Resources ---
    // API GatewayのResourceオブジェクトを作成
    // 実態としては"/"のResourceオブジェクトに対して"/books"のリソースを追加している
    // また、それぞれのMethodオブジェクトがIntegrationオブジェクトを保持するのがけっこうポイント！！
    // ちなみに、AuthorizerオブジェクトもMethodオブジェクトに保持できる
    const books = restApi.root.addResource("books");
    const getMethod = books.addMethod("GET", integration);
    const postMethod = books.addMethod("POST", integration, {
      // API keyを必須にする
      apiKeyRequired: true,
    });
    // "/books/{id}"のリソースを追加
    const book = books.addResource("{id}");
    book.addMethod("GET", integration);

    // --- Usage Plan ---
    // 使用料プランオブジェクトがAPI keyとstageを保持する。
    const plan = restApi.addUsagePlan("UsagePlan", {
      name: "Normal",
      throttle: {
        rateLimit: 20,
        burstLimit: 200,
      },
    });
    plan.addApiKey(restApi.addApiKey("MyApiKey"));
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
