namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class statistics : DbMigration
    {
        public override void Up()
        {
            AddColumn("dbo.BillDataModel", "VerticalValue", c => c.Decimal(nullable: false, precision: 18, scale: 2));
            AddColumn("dbo.BillDataModel", "HorizontalValue", c => c.Decimal(nullable: false, precision: 18, scale: 2));
            AddColumn("dbo.VoteDateModel", "VerticalValue", c => c.Decimal(nullable: false, precision: 18, scale: 2));
            AddColumn("dbo.VoteDateModel", "HorizontalValue", c => c.Decimal(nullable: false, precision: 18, scale: 2));
            RenameColumn(table: "dbo.VoteDateModel", name: "BillId", newName: "BillDataModelId");
        }
        
        public override void Down()
        {
            RenameColumn(table: "dbo.VoteDateModel", name: "BillDataModelId", newName: "BillId");
            DropColumn("dbo.VoteDateModel", "HorizontalValue");
            DropColumn("dbo.VoteDateModel", "VerticalValue");
            DropColumn("dbo.BillDataModel", "HorizontalValue");
            DropColumn("dbo.BillDataModel", "VerticalValue");
        }
    }
}
