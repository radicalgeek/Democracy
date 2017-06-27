namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class indexing : DbMigration
    {
        public override void Up()
        {
            DropIndex("dbo.BillStanceDateModel", new[] { "UserId" });
            DropIndex("dbo.ParticipationRecord", new[] { "UserId" });
        }
        
        public override void Down()
        {
            CreateIndex("dbo.ParticipationRecord", "UserId");
            CreateIndex("dbo.BillStanceDateModel", "UserId");
        }
    }
}
