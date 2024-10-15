import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpServiceDiscoveryIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { aws_apigateway, aws_lambda_nodejs, aws_lambda } from "aws-cdk-lib";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";
import {
  HttpLambdaAuthorizer,
  HttpLambdaResponseType,
} from "aws-cdk-lib/aws-apigatewayv2-authorizers";

import { Construct } from "constructs";

type Props = {
  vpc: ec2.Vpc;
  sgService: ec2.SecurityGroup;
  ecsServiceDiscovery: servicediscovery.Service;
};

export class PromptfooApi extends Construct {
  readonly api: apigwv2.HttpApi;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;
    // これはECS ServiceのConstructから出力してくる
    const ecsServiceDiscovery = props.ecsServiceDiscovery;
    // ECS Serviceのセキュリティグループ
    const sgService = props.sgService;

    const sgVpcLink = new ec2.SecurityGroup(this, "vpc-link-sg", {
      vpc,
      allowAllOutbound: true,
      description: "Security Group of Promptfoo VPC Link",
    });
    // VPC Link -> ECS Service 間の通信を許可
    // これが無いと通信できない。２時間くらいハマった。
    // cloud mapやservice discoveryが挟まっているが、ENIの目線だとVPC LinkとECS Serviceが直接通信する形になる！
    sgService.connections.allowFrom(
      sgVpcLink,
      ec2.Port.allTraffic(),
      "Access from VPC Link"
    );

    const vpcLink = new apigwv2.VpcLink(this, "PromptfooVpcLink", {
      vpc,
      subnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [sgVpcLink],
    });

    const integration = new HttpServiceDiscoveryIntegration(
      "PromptfooServiceDiscoveryIntegration",
      ecsServiceDiscovery,
      {
        vpcLink,
      }
    );

    // NOTE: Authorizerは別に切り出してもいいかも
    // NOTE: http apiはrest apiと違いリソースポリシーによるIP制限ができない。そのためLambda AuthorizerでIP制限を実装する。
    const handler = new aws_lambda_nodejs.NodejsFunction(
      this,
      "PromptfooIpRestrictHandler",
      {
        functionName: "PromptfooIpRestrictHandler",
        entry: "./src/lambda/ipRestriction.ts",
        handler: "handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        runtime: aws_lambda.Runtime.NODEJS_20_X,
      }
    );
    // NOTE: HttpLambdaAuthorizerではPayloadFormatVersionを指定することができず、強制的にversion 2が選択される。
    // refs: https://github.com/aws/aws-cdk/issues/21492
    const authorizer = new HttpLambdaAuthorizer(
      "PromptfooApiGatewayAuthorizer",
      handler,
      {
        // 他にtrue/falseを返す SIMPLE も選べる
        responseTypes: [HttpLambdaResponseType.IAM],
        // 認証に使うヘッダー値などを指定する。デフォルトは ['$request.header.Authorization']
        identitySource: [],
        // identitySource がキャッシュキーとなるため、identitySourceが未指定の場合は0秒に設定する
        resultsCacheTtl: cdk.Duration.seconds(0),
      }
    );

    const httpEndpoint = new apigwv2.HttpApi(this, "PromptfooHttpProxyApi", {
      defaultIntegration: integration,
      defaultAuthorizer: authorizer,
    });

    this.api = httpEndpoint;
  }
}
