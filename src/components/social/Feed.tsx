import { PostCard, type PostData } from "./PostCard";

export function Feed({ posts }: { posts: PostData[] }) {
  return (
    <div className="px-0">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
