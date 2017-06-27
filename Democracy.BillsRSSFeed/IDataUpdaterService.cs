using System.Web;

namespace Democracy.Bills
{
    public interface IDataUpdaterService
    {
        void UpdateBillData(HttpContext context);
    }
}