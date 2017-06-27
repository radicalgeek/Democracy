namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class third : DbMigration
    {
        public override void Up()
        {
            CreateTable(
                "dbo.BillCommentDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        CommentDate = c.DateTime(nullable: false),
                        Text = c.String(),
                        Bill_Id = c.Int(),
                        User_Id = c.String(maxLength: 128),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.BillDataModel", t => t.Bill_Id)
                .ForeignKey("dbo.AspNetUsers", t => t.User_Id)
                .Index(t => t.Bill_Id)
                .Index(t => t.User_Id);
            
            CreateTable(
                "dbo.MpVoteRecord",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        Date = c.DateTime(nullable: false),
                        Vote = c.Int(nullable: false),
                        Bill_Id = c.Int(),
                        Mp_Id = c.Int(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.BillDataModel", t => t.Bill_Id)
                .ForeignKey("dbo.MPDataModel", t => t.Mp_Id)
                .Index(t => t.Bill_Id)
                .Index(t => t.Mp_Id);
            
            CreateTable(
                "dbo.OpinionDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        BillId = c.Int(nullable: false),
                        House = c.String(),
                        Stage = c.String(),
                        Vote = c.Boolean(nullable: false),
                        Constituency_Id = c.Int(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.ConstituencyDataModel", t => t.Constituency_Id)
                .Index(t => t.Constituency_Id);
            
            CreateTable(
                "dbo.ParticipationRecord",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        UserId = c.String(),
                        BillId = c.Int(nullable: false),
                        Stage = c.String(),
                        House = c.String(),
                    })
                .PrimaryKey(t => t.Id);
            
            CreateTable(
                "dbo.VoteDateModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        BillId = c.Int(nullable: false),
                        House = c.String(),
                        Stage = c.String(),
                        Vote = c.Boolean(nullable: false),
                        Constituency_Id = c.Int(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.ConstituencyDataModel", t => t.Constituency_Id)
                .Index(t => t.Constituency_Id);
            
        }
        
        public override void Down()
        {
            DropForeignKey("dbo.VoteDateModel", "Constituency_Id", "dbo.ConstituencyDataModel");
            DropForeignKey("dbo.OpinionDataModel", "Constituency_Id", "dbo.ConstituencyDataModel");
            DropForeignKey("dbo.MpVoteRecord", "Mp_Id", "dbo.MPDataModel");
            DropForeignKey("dbo.MpVoteRecord", "Bill_Id", "dbo.BillDataModel");
            DropForeignKey("dbo.BillCommentDataModel", "User_Id", "dbo.AspNetUsers");
            DropForeignKey("dbo.BillCommentDataModel", "Bill_Id", "dbo.BillDataModel");
            DropIndex("dbo.VoteDateModel", new[] { "Constituency_Id" });
            DropIndex("dbo.OpinionDataModel", new[] { "Constituency_Id" });
            DropIndex("dbo.MpVoteRecord", new[] { "Mp_Id" });
            DropIndex("dbo.MpVoteRecord", new[] { "Bill_Id" });
            DropIndex("dbo.BillCommentDataModel", new[] { "User_Id" });
            DropIndex("dbo.BillCommentDataModel", new[] { "Bill_Id" });
            DropTable("dbo.VoteDateModel");
            DropTable("dbo.ParticipationRecord");
            DropTable("dbo.OpinionDataModel");
            DropTable("dbo.MpVoteRecord");
            DropTable("dbo.BillCommentDataModel");
        }
    }
}
