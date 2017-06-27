using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace Democracy.Bills.Extentions
{
    public static class QueryHelpers
    {
        public static IEnumerable<T> ExceptWhere<T>(this IEnumerable<T> source, Predicate<T> predicate)
        {
            return source.Where(x => !predicate(x));
        }

        public static IQueryable<T> IncludeMultiple<T>(this IQueryable<T> query,
            params Expression<Func<T, object>>[] includes) where T : class
        {
            if (includes != null)
            {
                //query = includes.Aggregate(query, (current, include) => current.Include(include));
            }
            return query;
        }
    }
}
