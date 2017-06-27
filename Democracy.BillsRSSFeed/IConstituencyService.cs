using Democracy.Data.DataModels;
using Democracy.Models;

namespace Democracy.Bills
{
    public interface IConstituencyService
    {
        ConstituencyDataModel GetConstituency(string postcode);
        ApplicationUser GetUserWithConstituency(string id);
    }
}