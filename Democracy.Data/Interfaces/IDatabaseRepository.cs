using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace Democracy.Data.Interfaces
{
    public interface IDatabaseRepository : IDisposable
    {
        void CommitChanges();
        void Delete<T>(Expression<Func<T, bool>> expression) where T : class, new();
        void Delete<T>(T item) where T : class, new();
        void DeleteAll<T>() where T : class, new();
        T Single<T>(Expression<Func<T, bool>> expression) where T : class, new();

        T SingleIncluding<T>(Expression<Func<T, bool>> expression, params Expression<Func<T, object>>[] includeProperties) where T : class, new();
        IQueryable<T> All<T>() where T : class, new();

        Task<List<T>> AllAsync<T>() where T : class, new();
        IQueryable<T> AllIncluding<T>(params Expression<Func<T, object>>[] includeProperties) where T : class, new();

        Task<List<T>> AllIncludingAsync<T>(params Expression<Func<T, object>>[] includeProperties) where T : class, new();
        void Add<T>(T item) where T : class, new();
        void Add<T>(IEnumerable<T> items) where T : class, new();
        void Update<T>(T item) where T : class, new();
    }
}
