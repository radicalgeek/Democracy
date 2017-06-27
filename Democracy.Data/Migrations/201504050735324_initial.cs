namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class initial : DbMigration
    {
        public override void Up()
        {
            CreateTable(
                "dbo.BillDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        Stage = c.String(),
                        Title = c.String(),
                        Description = c.String(),
                        House = c.String(),
                        BillType = c.String(),
                        UpdatedDate = c.DateTime(nullable: false),
                        Url = c.String(),
                        SocialScore = c.Double(nullable: false),
                        EconomicScore = c.Double(nullable: false),
                        IsNew = c.Boolean(nullable: false),
                        IsUpdated = c.Boolean(nullable: false),
                    })
                .PrimaryKey(t => t.Id);
            
            CreateTable(
                "dbo.ConstituencyDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        Name = c.String(),
                    })
                .PrimaryKey(t => t.Id);
            
            CreateTable(
                "dbo.PeoplesDebatPostDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        BillId = c.Int(nullable: false),
                        Text = c.String(),
                        Date = c.DateTime(nullable: false),
                        Author_Id = c.String(maxLength: 128),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.AspNetUsers", t => t.Author_Id)
                .Index(t => t.Author_Id);
            
            CreateTable(
                "dbo.AspNetUsers",
                c => new
                    {
                        Id = c.String(nullable: false, maxLength: 128),
                        IsIdentityVerified = c.Boolean(nullable: false),
                        ImageUrl = c.String(),
                        Email = c.String(maxLength: 256),
                        EmailConfirmed = c.Boolean(nullable: false),
                        PasswordHash = c.String(),
                        SecurityStamp = c.String(),
                        PhoneNumber = c.String(),
                        PhoneNumberConfirmed = c.Boolean(nullable: false),
                        TwoFactorEnabled = c.Boolean(nullable: false),
                        LockoutEndDateUtc = c.DateTime(),
                        LockoutEnabled = c.Boolean(nullable: false),
                        AccessFailedCount = c.Int(nullable: false),
                        UserName = c.String(nullable: false, maxLength: 256),
                        Constituency_Id = c.Int(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.ConstituencyDataModel", t => t.Constituency_Id)
                .Index(t => t.UserName, unique: true, name: "UserNameIndex")
                .Index(t => t.Constituency_Id);
            
            CreateTable(
                "dbo.AspNetUserClaims",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        UserId = c.String(nullable: false, maxLength: 128),
                        ClaimType = c.String(),
                        ClaimValue = c.String(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.AspNetUsers", t => t.UserId)
                .Index(t => t.UserId);
            
            CreateTable(
                "dbo.AspNetUserLogins",
                c => new
                    {
                        LoginProvider = c.String(nullable: false, maxLength: 128),
                        ProviderKey = c.String(nullable: false, maxLength: 128),
                        UserId = c.String(nullable: false, maxLength: 128),
                    })
                .PrimaryKey(t => new { t.LoginProvider, t.ProviderKey, t.UserId })
                .ForeignKey("dbo.AspNetUsers", t => t.UserId)
                .Index(t => t.UserId);
            
            CreateTable(
                "dbo.AspNetUserRoles",
                c => new
                    {
                        UserId = c.String(nullable: false, maxLength: 128),
                        RoleId = c.String(nullable: false, maxLength: 128),
                    })
                .PrimaryKey(t => new { t.UserId, t.RoleId })
                .ForeignKey("dbo.AspNetUsers", t => t.UserId)
                .ForeignKey("dbo.AspNetRoles", t => t.RoleId)
                .Index(t => t.UserId)
                .Index(t => t.RoleId);
            
            CreateTable(
                "dbo.DebateDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        Body = c.String(),
                        Date = c.DateTime(nullable: false),
                        BillId = c.Int(nullable: false),
                        Speaker_Id = c.Int(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.MPDataModel", t => t.Speaker_Id)
                .Index(t => t.Speaker_Id);
            
            CreateTable(
                "dbo.MPDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        TWFYMemberId = c.Int(nullable: false),
                        TWFYPersonId = c.Int(nullable: false),
                        Name = c.String(),
                        Party = c.Int(nullable: false),
                        ImageUrl = c.String(),
                        Constituency_Id = c.Int(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.ConstituencyDataModel", t => t.Constituency_Id)
                .Index(t => t.Constituency_Id);
            
            CreateTable(
                "dbo.OfficeDataModel",
                c => new
                    {
                        Id = c.Int(nullable: false, identity: true),
                        Department = c.String(),
                        Position = c.String(),
                        FromDate = c.DateTime(nullable: false),
                        ToDate = c.DateTime(nullable: false),
                        MPDataModel_Id = c.Int(),
                    })
                .PrimaryKey(t => t.Id)
                .ForeignKey("dbo.MPDataModel", t => t.MPDataModel_Id)
                .Index(t => t.MPDataModel_Id);
            
            CreateTable(
                "dbo.AspNetRoles",
                c => new
                    {
                        Id = c.String(nullable: false, maxLength: 128),
                        Name = c.String(nullable: false, maxLength: 256),
                    })
                .PrimaryKey(t => t.Id)
                .Index(t => t.Name, unique: true, name: "RoleNameIndex");
            
        }
        
        public override void Down()
        {
            DropForeignKey("dbo.AspNetUserRoles", "RoleId", "dbo.AspNetRoles");
            DropForeignKey("dbo.DebateDataModel", "Speaker_Id", "dbo.MPDataModel");
            DropForeignKey("dbo.OfficeDataModel", "MPDataModel_Id", "dbo.MPDataModel");
            DropForeignKey("dbo.MPDataModel", "Constituency_Id", "dbo.ConstituencyDataModel");
            DropForeignKey("dbo.PeoplesDebatPostDataModel", "Author_Id", "dbo.AspNetUsers");
            DropForeignKey("dbo.AspNetUserRoles", "UserId", "dbo.AspNetUsers");
            DropForeignKey("dbo.AspNetUserLogins", "UserId", "dbo.AspNetUsers");
            DropForeignKey("dbo.AspNetUsers", "Constituency_Id", "dbo.ConstituencyDataModel");
            DropForeignKey("dbo.AspNetUserClaims", "UserId", "dbo.AspNetUsers");
            DropIndex("dbo.AspNetRoles", "RoleNameIndex");
            DropIndex("dbo.OfficeDataModel", new[] { "MPDataModel_Id" });
            DropIndex("dbo.MPDataModel", new[] { "Constituency_Id" });
            DropIndex("dbo.DebateDataModel", new[] { "Speaker_Id" });
            DropIndex("dbo.AspNetUserRoles", new[] { "RoleId" });
            DropIndex("dbo.AspNetUserRoles", new[] { "UserId" });
            DropIndex("dbo.AspNetUserLogins", new[] { "UserId" });
            DropIndex("dbo.AspNetUserClaims", new[] { "UserId" });
            DropIndex("dbo.AspNetUsers", new[] { "Constituency_Id" });
            DropIndex("dbo.AspNetUsers", "UserNameIndex");
            DropIndex("dbo.PeoplesDebatPostDataModel", new[] { "Author_Id" });
            DropTable("dbo.AspNetRoles");
            DropTable("dbo.OfficeDataModel");
            DropTable("dbo.MPDataModel");
            DropTable("dbo.DebateDataModel");
            DropTable("dbo.AspNetUserRoles");
            DropTable("dbo.AspNetUserLogins");
            DropTable("dbo.AspNetUserClaims");
            DropTable("dbo.AspNetUsers");
            DropTable("dbo.PeoplesDebatPostDataModel");
            DropTable("dbo.ConstituencyDataModel");
            DropTable("dbo.BillDataModel");
        }
    }
}
