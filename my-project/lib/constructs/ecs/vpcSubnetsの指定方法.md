### サブネットの性質で指定する場合

PUBLIC なサブネットが複数あると使えない

```ts
vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
```

<br/>
<br/>

### サブネットの名前で指定する方法(=サブネット ID で指定する方法)

```ts
vpcSubnets: { subnetGroupName: "public-subnet-1" },
```

<br/>

サブネット ID を名前から取得して、ID で指定することもできる。  
明示的に複数サブネットを紐づける記述にしたい場合はこっちのが良い？？

```ts
// subnet idの取得
const { subnetIds: albSubnetIds } = vpc.selectSubnets({
    subnetGroupName: "sbcntr-subnet-private-container",
});

vpcSubnets: {
    subnets: [
        ec2.Subnet.fromSubnetId(this, "ECSSubnet1", albSubnetIds[0]),
        ec2.Subnet.fromSubnetId(this, "ECSSubnet2", albSubnetIds[1]),
    ],
},
```

<br/>
<br/>
