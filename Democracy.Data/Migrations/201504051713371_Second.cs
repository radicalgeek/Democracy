namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class Second : DbMigration
    {
        public override void Up()
        {
            AddColumn("dbo.PeoplesDebatPostDataModel", "Bill_Id", c => c.Int());
            CreateIndex("dbo.PeoplesDebatPostDataModel", "Bill_Id");
            AddForeignKey("dbo.PeoplesDebatPostDataModel", "Bill_Id", "dbo.BillDataModel", "Id");
            DropColumn("dbo.PeoplesDebatPostDataModel", "BillId");
        }
        
        public override void Down()
        {
            AddColumn("dbo.PeoplesDebatPostDataModel", "BillId", c => c.Int(nullable: false));
            DropForeignKey("dbo.PeoplesDebatPostDataModel", "Bill_Id", "dbo.BillDataModel");
            DropIndex("dbo.PeoplesDebatPostDataModel", new[] { "Bill_Id" });
            DropColumn("dbo.PeoplesDebatPostDataModel", "Bill_Id");
        }
    }
}
