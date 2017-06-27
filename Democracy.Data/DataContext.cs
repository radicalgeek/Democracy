using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Data.Entity.Migrations;
using System.Data.Entity.ModelConfiguration.Conventions;
using System.Data.SqlClient;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Democracy.Bills;
using Democracy.Data.DataModels;
using Democracy.Models;
using Microsoft.AspNet.Identity.EntityFramework;

namespace Democracy.Data
{
    public class DataContext : IdentityDbContext<ApplicationUser>, IDisposable
    {
        public DbSet<BillCommentDataModel> BillComments { get; set; }
        public DbSet<BillDataModel> Bills { get; set; }
        public DbSet<ConstituencyDataModel> Constituencies { get; set; }
        public DbSet<DebateDataModel> Debates { get; set; }
        public DbSet<MPDataModel> MPs { get; set; }
        public DbSet<MpVoteRecord> MPVotes { get; set; }
        public DbSet<OfficeDataModel> Offices { get; set; }
        public DbSet<OpinionDataModel> Opinions { get; set; }
        public DbSet<ParticipationRecord> ParticipationRecords { get; set; }
        public DbSet<PeoplesDebatPostDataModel> DebatePosts { get; set; }
        public DbSet<BillStanceDateModel> BillStanceRecords { get; set; }
        public DbSet<VoteDateModel> Votes { get; set; }

        public DataContext()
            : base("DataEntities", throwIfV1Schema: false)
        {

        }

        public static DataContext Create()
        {
            return new DataContext();
        }

        

        protected override void OnModelCreating(DbModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Conventions
                .Remove<System.Data.Entity.ModelConfiguration.Conventions.PluralizingTableNameConvention>();

            modelBuilder.Conventions.Remove<OneToManyCascadeDeleteConvention>();



        }

        public static void Initialize(string connectionString)
        {
            var bld = new SqlConnectionStringBuilder(connectionString);
            //get name of database to connect
            var dbName = bld.InitialCatalog;

            //get connection string to Master database
            bld.InitialCatalog = "master";
            var masterConnectionString = bld.ConnectionString;

            //create the database, if it doesn't exist
            bool shouldRunSeed = false;
            using (var cnn = new SqlConnection(masterConnectionString))
            {
                var cmdString1 =
                    string.Format("select * from sys.databases where name='{0}'",
                                  dbName);
                var cmdString2 =
                    string.Format("create database {0}",
                                  dbName);
                int result;
                using (var cmd = new System.Data.SqlClient.SqlCommand(cmdString1, cnn))
                {
                    cmd.Connection.Open();
                    result = cmd.ExecuteNonQuery();
                    cmd.Connection.Close();
                    if (result == 0)
                    {
                        using (var cmd2 = new SqlCommand(cmdString2, cnn))
                        {
                            cmd2.Connection.Open();
                            cmd2.ExecuteNonQuery();
                        }
                        shouldRunSeed = true;
                    }
                }
            }

            var connectionInfo = new System.Data.Entity.Infrastructure.DbConnectionInfo(connectionString, "System.Data.SqlClient");

            var config = new DbMigrationsConfiguration();
            config.TargetDatabase = connectionInfo;

            var migrator = new DbMigrator(config);
            migrator.Configuration.AutomaticMigrationDataLossAllowed = true;
            migrator.Configuration.AutomaticMigrationsEnabled = true;
            var pendingMigrations = migrator.GetPendingMigrations();


            if (pendingMigrations.Any())
            {
                System.Threading.Thread.Sleep(5000);
                migrator.Update();
                if (shouldRunSeed)
                {
                    var ctx2 = new DataContext();
                    Seed(ctx2);
                }

            }
            migrator.Configuration.AutomaticMigrationsEnabled = false;
        }

        public static void Seed(DataContext context)
        {
#if DEBUG

#endif

        }

        public void Dispose()
        {

        }
    }
}
