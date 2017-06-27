using Democracy.Data.Interfaces;
using Democracy.Models;

namespace Democracy.Bills
{
    public class UserService : IUserService
    {
        private readonly IDatabaseRepository _db;

        public UserService(IDatabaseRepository db)
        {
            _db = db;
        }
        public void UpdateUser(string id, string picture, string screenName)
        {
            var user = _db.Single<ApplicationUser>(u => u.Id == id);
            user.ScreenName = screenName;
            user.ImageUrl = picture;
            _db.CommitChanges();
        }
    }
}