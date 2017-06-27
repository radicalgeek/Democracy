namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class billStance : DbMigration
    {
        public override void Up()
        {
            CreateTable(
                "dbo.BillStanceDateModel",
                c => new
                    {
                        id = c.Int(nullable: false, identity: true),
                        UserId = c.String(),
                        HorizontalValue = c.Decimal(nullable: false, precision: 18, scale: 2),
                        VerticalValue = c.Decimal(nullable: false, precision: 18, scale: 2),
                        BillId = c.Int(nullable: false),
                    })
                .PrimaryKey(t => t.id);
            
        }
        
        public override void Down()
        {
            DropTable("dbo.BillStanceDateModel");
        }
    }
}
