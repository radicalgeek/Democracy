namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class voteconstituencyfix : DbMigration
    {
        public override void Up()
        {
            DropIndex("dbo.VoteDateModel", new[] { "Constituency_Id" });
            RenameColumn(table: "dbo.VoteDateModel", name: "Constituency_Id", newName: "ConstituencyDataModelId");
            AlterColumn("dbo.VoteDateModel", "ConstituencyDataModelId", c => c.Int(nullable: false));
            CreateIndex("dbo.VoteDateModel", "ConstituencyDataModelId");
        }
        
        public override void Down()
        {
            DropIndex("dbo.VoteDateModel", new[] { "ConstituencyDataModelId" });
            AlterColumn("dbo.VoteDateModel", "ConstituencyDataModelId", c => c.Int());
            RenameColumn(table: "dbo.VoteDateModel", name: "ConstituencyDataModelId", newName: "Constituency_Id");
            CreateIndex("dbo.VoteDateModel", "Constituency_Id");
        }
    }
}
