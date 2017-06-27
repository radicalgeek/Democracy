namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class constituencystorageonuserupdate : DbMigration
    {
        public override void Up()
        {
            DropIndex("dbo.AspNetUsers", new[] { "Constituency_Id" });
            RenameColumn(table: "dbo.AspNetUsers", name: "Constituency_Id", newName: "ConstituencyDataModelId");
            AlterColumn("dbo.AspNetUsers", "ConstituencyDataModelId", c => c.Int(nullable: false));
            CreateIndex("dbo.AspNetUsers", "ConstituencyDataModelId");
        }
        
        public override void Down()
        {
            DropIndex("dbo.AspNetUsers", new[] { "ConstituencyDataModelId" });
            AlterColumn("dbo.AspNetUsers", "ConstituencyDataModelId", c => c.Int());
            RenameColumn(table: "dbo.AspNetUsers", name: "ConstituencyDataModelId", newName: "Constituency_Id");
            CreateIndex("dbo.AspNetUsers", "Constituency_Id");
        }
    }
}
