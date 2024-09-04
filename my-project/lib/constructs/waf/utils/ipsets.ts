import { CfnIPSet } from "aws-cdk-lib/aws-wafv2";
import { Construct } from "constructs";

/**
 * Properties for configuring IP sets for AWS WAF.
 */
export interface WafIpSetsProps {
  readonly namePrefix: string;
  readonly ipv4List?: string[];
  readonly ipv6List?: string[];
  readonly webAclScope: string;
}

/**
 * Creates and manages AWS WAF IP sets for IPv4 and IPv6 addresses.
 */
export class WafIpSets extends Construct {
  /**
   * The list of CloudFormation IP set resources created by this construct.
   */
  public readonly ipSetList: CfnIPSet[];

  /**
   * Constructs a new instance of the WafIpSets class.
   * @param scope The scope in which to define this construct.
   * @param id A unique identifier for this construct.
   * @param props The properties for the IP sets.
   */
  constructor(scope: Construct, id: string, props: WafIpSetsProps) {
    super(scope, id);

    const { namePrefix, ipv4List, ipv6List, webAclScope } = props;

    this.ipSetList = [];

    let Ipv4Set, Ipv6Set;
    if (ipv4List && ipv4List.length > 0) {
      Ipv4Set = new CfnIPSet(this, `${namePrefix}Ipv4Set`, {
        name: `${namePrefix}Ipv4Set`,
        scope: webAclScope,
        ipAddressVersion: "IPV4",
        addresses: ipv4List,
      });
      this.ipSetList.push(Ipv4Set);
    }
    if (ipv6List && ipv6List.length > 0) {
      Ipv6Set = new CfnIPSet(this, `${namePrefix}Ipv6Set`, {
        name: `${namePrefix}Ipv6Set`,
        scope: webAclScope,
        ipAddressVersion: "IPV6",
        addresses: ipv6List,
      });
      this.ipSetList.push(Ipv6Set);
    }
  }

  public hasIpSets(): boolean {
    return this.ipSetList.length > 0;
  }
}
