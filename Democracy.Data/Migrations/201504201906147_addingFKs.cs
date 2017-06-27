namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class addingFKs : DbMigration
    {
        public override void Up()
        {
            DropIndex("dbo.PeoplesDebatPostDataModel", new[] { "Bill_Id" });
            RenameColumn(table: "dbo.PeoplesDebatPostDataModel", name: "Bill_Id", newName: "BillDataModelId");
            AlterColumn("dbo.PeoplesDebatPostDataModel", "BillDataModelId", c => c.Int(nullable: false));
            CreateIndex("dbo.PeoplesDebatPostDataModel", "BillDataModelId");
        }
        
        public override void Down()
        {
            DropIndex("dbo.PeoplesDebatPostDataModel", new[] { "BillDataModelId" });
            AlterColumn("dbo.PeoplesDebatPostDataModel", "BillDataModelId", c => c.Int());
            RenameColumn(table: "dbo.PeoplesDebatPostDataModel", name: "BillDataModelId", newName: "Bill_Id");
            CreateIndex("dbo.PeoplesDebatPostDataModel", "Bill_Id");
        }
    }
}
