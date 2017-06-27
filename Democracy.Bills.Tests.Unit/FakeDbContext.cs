using System;
using System.Data.Entity;
using Democracy.Data.DataModels;

namespace Democracy.Bills.Tests.Unit
{
    public interface IFakeDbContext
    {
        DbSet<T> Set<T>() where T : class;
        

    }

    public class FakeDbContext : DbContext, IDisposable, IFakeDbContext
    {
        public virtual DbSet<BillDataModel> Bills { get; set; }

       
    }
}