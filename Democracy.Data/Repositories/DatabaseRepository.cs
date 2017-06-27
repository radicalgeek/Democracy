using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;
using Democracy.Data.Interfaces;

namespace Democracy.Data.Repositories
{
    public class DatabaseRepository : IDatabaseRepository
    {
        readonly DbContext _context;
        public DatabaseRepository(DbContext context)
        {
            _context = context;
        }

        public void CommitChanges()
        {
            using (_context)
            {
                _context.SaveChanges();
            }
            
        }

        

        public void Delete<T>(Expression<Func<T, bool>> expression) where T : class, new()
        {
            var query = All<T>().Where(expression);
            foreach (var item in query)
            {
                Delete(item);
            }
        }

        public void Delete<T>(T item) where T : class, new()
        {
            using (_context)
            {
                _context.Set<T>().Remove(item);
            }
            
        }

        public void DeleteAll<T>() where T : class, new()
        {
            var query = All<T>();
            foreach (var item in query)
            {
                Delete(item);
            }
        }

        public void Dispose()
        {
            _context.Dispose();
        }

        public T Single<T>(Expression<Func<T, bool>> expression) where T : class, new()
        {
            return All<T>().FirstOrDefault(expression);
        }

        public T SingleIncluding<T>(Expression<Func<T, bool>> expression, params Expression<Func<T, object>>[] includeProperties) where T : class, new()
        {
            return AllIncluding<T>(includeProperties).FirstOrDefault(expression);
        }

        public IQueryable<T> All<T>() where T : class, new()
        {
            using (_context)
            {
                return  _context.Set<T>().AsQueryable();
            }
        }

        public async Task<List<T>> AllAsync<T>() where T : class, new()
        {
            using (_context)
            {
                return await _context.Set<T>().ToListAsync();
            }
        }

        public IQueryable<T> AllIncluding<T>(params Expression<Func<T, object>>[] includeProperties) where T : class, new()
        {
            IQueryable<T> query = _context.Set<T>();
            Array.ForEach(includeProperties, includeProperty => query = query.Include(includeProperty));
            return query.AsQueryable();
        }

        public async Task<List<T>> AllIncludingAsync<T>(params Expression<Func<T, object>>[] includeProperties) where T : class, new()
        {
            IQueryable<T> query = _context.Set<T>();
            Array.ForEach(includeProperties, includeProperty => query = query.Include(includeProperty));
            return await query.ToListAsync(); 
        }


        public void Add<T>(T item) where T : class, new()
        {
            using (_context)
            {
                _context.Set<T>().Add(item);   
            }
            }


        public void Add<T>(IEnumerable<T> items) where T : class, new()
        {
            foreach (var item in items)
            {
                Add(item);
            }
        }

        public void Update<T>(T item) where T : class, new()
        {
            using (_context)
            {
                _context.Entry<T>(item).State = EntityState.Modified;    
            }
        }
    }
}
