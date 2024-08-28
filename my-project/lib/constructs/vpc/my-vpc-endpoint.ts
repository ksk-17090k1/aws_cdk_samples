import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Tags } from "aws-cdk-lib";

type Props = {
  vpc: ec2.IVpc;
  sgEgress: ec2.ISecurityGroup;
};

export class SbcntrVpcEndPoint extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;
    const sgEgress = props.sgEgress;

    const ecrEndpoint = new ec2.InterfaceVpcEndpoint(this, "EcrVpcEndpoint", {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      // multi Azにしている場合は複数のsubnetに紐づけられる
      subnets: {
        subnetGroupName: "sbcntr-subnet-private-egress",
      },
      securityGroups: [sgEgress],
      // openをtrueにするとセキュリティグループにVPC内からのアクセスを許可するルールが追加される
      // ref: https://qiita.com/yust0724/items/bc62c6063ee3e021d14f
      open: false,
    });
    // 現状のCDKではVpcEndpointにタグは付けられないらしい
    // ref: https://github.com/aws/aws-cdk/issues/19332
    Tags.of(ecrEndpoint).add("Name", "sbcntr-vpce-ecr-api");

    const dkrEndpoint = new ec2.InterfaceVpcEndpoint(
      this,
      "EcrDockerVpcEndpoint",
      {
        vpc,
        service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        subnets: {
          subnetGroupName: "sbcntr-subnet-private-egress",
        },
        securityGroups: [sgEgress],
        open: false,
      }
    );
    Tags.of(dkrEndpoint).add("Name", "sbcntr-vpce-ecr-dkr");

    const logsEndpoint = new ec2.InterfaceVpcEndpoint(
      this,
      "CloudWatchLogsVpcEndpoint",
      {
        vpc,
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        subnets: {
          subnetGroupName: "sbcntr-subnet-private-egress",
        },
        securityGroups: [sgEgress],
        open: false,
      }
    );
    Tags.of(logsEndpoint).add("Name", "sbcntr-vpce-ecr-logs");

    // Gateway型のVPC Endpointはセキュリティグループを指定できない
    // また、CDKの実装としてはsubnetsを指定するが、マネコンを見ると実態は
    // サブネットに紐づくルートテーブルが指定される仕組みになっている。
    // そのルートテーブルを見るとS3が宛先のときにVPC Endpointにルーティングされるようになっている。
    const s3Endpoint = new ec2.GatewayVpcEndpoint(this, "S3VpcEndpoint", {
      vpc,
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [
        {
          subnetGroupName: "sbcntr-subnet-private-container",
        },
      ],
    });
    Tags.of(s3Endpoint).add("Name", "sbcntr-vpce-ecr-s3");
  }
}
