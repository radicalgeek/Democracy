namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class again : DbMigration
    {
        public override void Up()
        {
            AddColumn("dbo.ConstituencyDataModel", "RegisterdVoters", c => c.Int(nullable: false));
        }
        
        public override void Down()
        {
            DropColumn("dbo.ConstituencyDataModel", "RegisterdVoters");
        }
    }
}
