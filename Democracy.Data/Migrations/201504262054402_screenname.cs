namespace Democracy.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class screenname : DbMigration
    {
        public override void Up()
        {
            AddColumn("dbo.AspNetUsers", "ScreenName", c => c.String());
        }
        
        public override void Down()
        {
            DropColumn("dbo.AspNetUsers", "ScreenName");
        }
    }
}
