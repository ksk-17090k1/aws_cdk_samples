import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

type Props = {
  vpc: ec2.IVpc;
  sg: ec2.ISecurityGroup;
};

export class SbcntrBastion extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);
    const vpc = props.vpc;

    const keyPair = new ec2.KeyPair(this, "KeyPair", {
      keyPairName: "MyKeyPair",
      type: ec2.KeyPairType.RSA,
      format: ec2.KeyPairFormat.PEM,
    });

    const instance = new ec2.Instance(this, "SbcntrBastionInstance", {
      instanceName: "SbcntrBastion",
      vpc,
      vpcSubnets: { subnetGroupName: "sbcntr-subnet-public-management" },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.NANO
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      keyName: keyPair.keyPairName,
      associatePublicIpAddress: true,
      securityGroup: props.sg,
    });
  }
}
