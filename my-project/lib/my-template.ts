import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_apigateway, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";

// interface Props extends cdk.StackProps {}  でも良い
type Props = cdk.StackProps & {};

export class MyLambdaStack extends cdk.Stack {
  readonly outputSample: cdk.CfnOutput;
  constructor(scope: Construct, id: string, props?: Props) {
    super(scope, id, props);

    // CfnOutput を使うと、Stackのデプロイ後にコンソールに出力される
    new cdk.CfnOutput(this, "FrontendURL", {
      value: "https://sample.com",
    });

    // Stack内で作成したConstructをinstance変数に格納することで、上層で別Stackに渡せる
    // NOTE: 別に CfnOutput にしなくても任意の型で渡せるが、CfnOutputとの組み合わせが多いのでこうしている
    this.outputSample = new cdk.CfnOutput(this, "WebAclId", {
      value: "sample",
    });
  }
}
