using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using Democracy.Data.Interfaces;

namespace Democracy.Bills.Tests.Unit
{
    public class StubDataRepository : IDatabaseRepository
    {
        readonly IFakeDbContext _context;
        public StubDataRepository(IFakeDbContext context)
        {
            _context = context;
        }
        
        public void Dispose()
        {
            throw new NotImplementedException();
        }

        public void CommitChanges()
        {
            //_context.SaveChanges();
        }

        public void Delete<T>(Expression<Func<T, bool>> expression) where T : class, new()
        {
            throw new NotImplementedException();
        }

        public void Delete<T>(T item) where T : class, new()
        {
            throw new NotImplementedException();
        }

        public void DeleteAll<T>() where T : class, new()
        {
            throw new NotImplementedException();
        }

        public T Single<T>(Expression<Func<T, bool>> expression) where T : class, new()
        {
            return All<T>().FirstOrDefault(expression);
        }

        public T SingleIncluding<T>(Expression<Func<T, bool>> expression, params Expression<Func<T, object>>[] includeProperties) where T : class, new()
        {
            throw new NotImplementedException();
        }

        public IQueryable<T> All<T>() where T : class, new()
        {
            return _context.Set<T>().AsQueryable();
        }

        public Task<List<T>> AllAsync<T>() where T : class, new()
        {
            throw new NotImplementedException();
        }

        public IQueryable<T> AllIncluding<T>(params Expression<Func<T, object>>[] includeProperties) where T : class, new()
        {
            throw new NotImplementedException();
        }

        public Task<List<T>> AllIncludingAsync<T>(params Expression<Func<T, object>>[] includeProperties) where T : class, new()
        {
            throw new NotImplementedException();
        }

        public void Add<T>(T item) where T : class, new()
        {
            _context.Set<T>().Add(item);
        }

        public void Add<T>(IEnumerable<T> items) where T : class, new()
        {
            throw new NotImplementedException();
        }

        public void Update<T>(T item) where T : class, new()
        {
            throw new NotImplementedException();
        }
    }
}