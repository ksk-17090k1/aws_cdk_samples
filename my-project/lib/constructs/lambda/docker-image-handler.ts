import {
  DockerImageCode,
  DockerImageFunction,
  Tracing,
} from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as path from "path";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from "aws-cdk-lib";

type Props = {};

export class MyDockerImageHandler extends Construct {
  readonly handler: DockerImageFunction;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const handlerRole = new iam.Role(this, "MyDockerImageHandlerRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    handlerRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        // LambdaがVPC内にある場合はこのポリシーが必要
        // NOTE: AWSLambdaBasicExecutionRoleはroleを明示的に指定しなければ自動で付与されるぽい。
        "service-role/AWSLambdaVPCAccessExecutionRole"
      )
    );

    const handler = new DockerImageFunction(this, "Handler", {
      code: DockerImageCode.fromImageAsset(
        path.join(__dirname, "../../../src/lambda/python"),
        {
          platform: Platform.LINUX_AMD64,
          file: "Dockerfile",
        }
      ),
      // VPCの中で作成する場合。デフォルトではVPCの中では作成されない。
      //   vpc: props.vpc,
      //   vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      // X-Rayの設定
      tracing: Tracing.ACTIVE,
      environment: {
        STAGE: "stg",
      },
      role: handlerRole,
    });

    this.handler = handler;
  }
}
