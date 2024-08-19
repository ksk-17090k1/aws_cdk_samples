import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";

type Props = {
  vpc: ec2.IVpc;
  albSecurityGroupId: string;
  backendHost: string;
};

export class SbcntrEcs extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = props.vpc;

    // ECS Cluster
    const cluster = new ecs.Cluster(this, "EcsCluster", {
      clusterName: `sbcntr-frontend-cluster`,
      vpc: vpc,
    });

    // Log Group
    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/ecs/sbcntr-frontend-def`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: iam.Role.fromRoleArn(
        this,
        "ExecutionRole",
        `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/ecsTaskExecutionRole`
      ),
    });

    const container = taskDefinition.addContainer("app", {
      image: ecs.ContainerImage.fromRegistry(
        `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/sbcntr-frontend:v1`
      ),
      logging: ecs.LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: "ecs",
      }),
      environment: {
        SESSION_SECRET_KEY: "41b678c65b37bf99c37bcab522802760",
        APP_SERVICE_HOST: `http://${props.backendHost}`,
        NOTIF_SERVICE_HOST: `http://${props.backendHost}`,
      },
    });

    container.addPortMappings({
      containerPort: 80,
      hostPort: 80,
      protocol: ecs.Protocol.TCP,
    });

    // Application Load Balancer
    const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      "ALBSecurityGroup",
      props.albSecurityGroupId
    );

    // subnet idの取得
    const { subnetIds: albSubnetIds } = vpc.selectSubnets({
      subnetGroupName: "sbcntr-subnet-public-ingress",
    });
    const alb = new elbv2.ApplicationLoadBalancer(this, "ALB", {
      vpc: vpc,
      securityGroup: securityGroup,
      internetFacing: true,
      loadBalancerName: `sbcntr-alb-ingress-frontend`,
      vpcSubnets: {
        subnets: [
          ec2.Subnet.fromSubnetId(this, "ALBSubnet1", albSubnetIds[0]),
          ec2.Subnet.fromSubnetId(this, "ALBSubnet2", albSubnetIds[1]),
        ],
      },
    });

    const targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc: vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: "/healthcheck",
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        healthyHttpCodes: "200",
      },
    });

    alb.addListener("Listener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.forward([targetGroup]),
    });
  }
}
